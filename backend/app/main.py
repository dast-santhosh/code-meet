from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .websocket import manager

app = FastAPI(title=settings.PROJECT_NAME)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "active_rooms_count": len(manager.rooms)
    }

@app.get("/rooms")
def get_active_rooms():
    active_rooms = {}
    for room_id, data in manager.rooms.items():
        active_rooms[room_id] = {
            "participants_count": len(data["users"]),
            "participants": [
                {"userId": uid, "name": u["name"], "role": u["role"]}
                for uid, u in data["users"].items()
            ]
        }
    return active_rooms

@app.websocket("/ws/meet/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    user_id: str = Query(...),
    name: str = Query(...),
    role: str = Query(...)
):
    await manager.connect(websocket, room_id, user_id, name, role)
    try:
        while True:
            # Listen for incoming JSON messages
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "yjs-update":
                # Save and broadcast collaborative editor updates
                update_data = data.get("update")
                # Store update in-memory
                manager.record_yjs_update(room_id, update_data)
                # Relay to all other participants in the room
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "yjs-update",
                        "senderId": user_id,
                        "update": update_data
                    },
                    exclude_user_id=user_id
                )
                
            elif msg_type == "webrtc-signal":
                # WebRTC packet relaying (offers, answers, ICE candidates)
                target = data.get("target")
                signal = data.get("signal")
                await manager.send_to_user(
                    room_id,
                    target,
                    {
                        "type": "webrtc-signal",
                        "senderId": user_id,
                        "signal": signal
                    }
                )
                
            elif msg_type == "chat-message":
                # Save and broadcast chat message
                chat_msg = {
                    "senderId": user_id,
                    "senderName": name,
                    "senderRole": role,
                    "text": data.get("text"),
                    "timestamp": data.get("timestamp")
                }
                manager.record_chat_message(room_id, chat_msg)
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "chat-message",
                        **chat_msg
                    }
                )
                
            elif msg_type == "hand-raise":
                # Broadcast hand raise to everyone
                is_raised = data.get("isRaised", False)
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "hand-raise",
                        "userId": user_id,
                        "name": name,
                        "isRaised": is_raised
                    }
                )
                
            elif msg_type == "remove-user":
                # Eviction command (Commandant only)
                if role == "commandant":
                    target = data.get("target")
                    if target:
                        # Direct message to cadet to force-evict
                        await manager.send_to_user(
                            room_id,
                            target,
                            {
                                "type": "eviction",
                                "message": "You have been removed from the session by the Commandant."
                            }
                        )
                        # Notify other users in the room
                        await manager.broadcast_to_room(
                            room_id,
                            {
                                "type": "peer-left",
                                "userId": target,
                                "message": "User was removed by Commandant"
                            }
                        )
                        
            elif msg_type == "peer-left":
                # Broadcast leaving notification
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "peer-left",
                        "userId": user_id
                    },
                    exclude_user_id=user_id
                )

    except WebSocketDisconnect:
        manager.disconnect(room_id, user_id)
        # Notify others of disconnection
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "peer-left",
                "userId": user_id
            }
        )
    except Exception as e:
        # Catch unexpected errors and close safely
        manager.disconnect(room_id, user_id)
        try:
            await websocket.close()
        except:
            pass
