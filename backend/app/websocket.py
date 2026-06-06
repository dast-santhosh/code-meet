import json
from typing import Dict, List, Set, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Structure: { room_id: { "users": { user_id: { "ws": WebSocket, "name": str, "role": str } }, "yjs_updates": list, "chat_history": list } }
        self.rooms: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, name: str, role: str):
        await websocket.accept()
        
        # Initialize room if not exists
        if room_id not in self.rooms:
            self.rooms[room_id] = {
                "users": {},
                "yjs_updates": [],
                "chat_history": []
            }
            
        room = self.rooms[room_id]
        
        # Add user
        room["users"][user_id] = {
            "ws": websocket,
            "name": name,
            "role": role,
            "videoMuted": False,
            "micMuted": True if role == "cadet" else False,
            "code": ""
        }
        
        # 1. Send active users list, Yjs update history, and Chat history to the newly joined user
        current_users = [
            {
                "userId": uid, 
                "name": info["name"], 
                "role": info["role"],
                "videoMuted": info.get("videoMuted", False),
                "micMuted": info.get("micMuted", False),
                "code": info.get("code", "")
            }
            for uid, info in room["users"].items()
        ]
        
        await websocket.send_json({
            "type": "sync-init",
            "users": current_users,
            "yjs_updates": room["yjs_updates"],
            "chat_history": room["chat_history"]
        })
        
        # 2. Broadcast user-joined notification to all other peers in the room
        await self.broadcast_to_room(
            room_id,
            {
                "type": "peer-joined",
                "userId": user_id,
                "name": name,
                "role": role,
                "videoMuted": room["users"][user_id]["videoMuted"],
                "micMuted": room["users"][user_id]["micMuted"],
                "code": room["users"][user_id]["code"]
            },
            exclude_user_id=user_id
        )

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms and user_id in self.rooms[room_id]["users"]:
            del self.rooms[room_id]["users"][user_id]
            # Clean up empty rooms
            if not self.rooms[room_id]["users"]:
                del self.rooms[room_id]
            return True
        return False

    async def broadcast_to_room(self, room_id: str, message: dict, exclude_user_id: str = None):
        if room_id not in self.rooms:
            return
            
        for uid, user_info in self.rooms[room_id]["users"].items():
            if exclude_user_id and uid == exclude_user_id:
                continue
            try:
                await user_info["ws"].send_json(message)
            except Exception:
                # Handle disconnected or stale sockets gracefully
                pass

    async def send_to_user(self, room_id: str, target_user_id: str, message: dict):
        if room_id in self.rooms and target_user_id in self.rooms[room_id]["users"]:
            try:
                await self.rooms[room_id]["users"][target_user_id]["ws"].send_json(message)
            except Exception:
                pass

    def record_yjs_update(self, room_id: str, update_base64: str):
        if room_id in self.rooms:
            self.rooms[room_id]["yjs_updates"].append(update_base64)

    def record_chat_message(self, room_id: str, chat_msg: dict):
        if room_id in self.rooms:
            self.rooms[room_id]["chat_history"].append(chat_msg)

manager = ConnectionManager()
