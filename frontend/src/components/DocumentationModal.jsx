import React, { useState } from 'react';
import { X, BookOpen, Compass, ChevronRight, Terminal } from 'lucide-react';

const DOCS_DATA = {
  numpy: {
    title: "NumPy Documentation",
    desc: "Numerical Python - the core library for scientific computing in Python.",
    sections: [
      {
        name: "Arrays Creation",
        content: "• Create array: np.array([1, 2, 3])\n• Create multidimensional array: np.array([[1,2], [3,4]])\n• Create array with zeros: np.zeros((row, col))\n• Create array with ones: np.ones((row, col))\n• Linear spacing: np.linspace(start, stop, count)"
      },
      {
        name: "Array Operations",
        content: "• Shape: arr.shape\n• Dimensions count: arr.ndim\n• Data type: arr.dtype\n• Reshape: arr.reshape(new_row, new_col)\n• Matrix Multiplication: np.dot(arr1, arr2) or arr1 @ arr2"
      },
      {
        name: "Statistical Functions",
        content: "• Sum: np.sum(arr)\n• Average: np.mean(arr)\n• Standard deviation: np.std(arr)\n• Minimum: np.min(arr)\n• Maximum: np.max(arr)"
      }
    ]
  },
  pandas: {
    title: "Pandas Documentation",
    desc: "Fast, powerful, flexible and easy to use data analysis and manipulation tool.",
    sections: [
      {
        name: "Series & DataFrame",
        content: "• Create Series: pd.Series([1, 3, 5])\n• Create DataFrame: pd.DataFrame(dictionary_or_list)\n• Read CSV File: pd.read_csv('filename.csv')\n• Save CSV: df.to_csv('filename.csv', index=False)"
      },
      {
        name: "Data Inspection",
        content: "• Print top lines: df.head(rows_count)\n• Print summary: df.info()\n• Summary statistics: df.describe()\n• Shape: df.shape\n• Columns list: df.columns"
      },
      {
        name: "Data Selection & Filtering",
        content: "• Select columns: df[['col1', 'col2']]\n• Index rows by label: df.loc[row_label, col_label]\n• Index rows by integer offset: df.iloc[row_index, col_index]\n• Filter rows: df[df['age'] > 18]"
      }
    ]
  },
  matplotlib: {
    title: "Matplotlib Documentation",
    desc: "Comprehensive library for creating static, animated, and interactive visualizations in Python.",
    sections: [
      {
        name: "Basic Plotting",
        content: "• Draw plot: plt.plot(x_values, y_values, label='My Line')\n• Add Title: plt.title('My Title')\n• Label X-Axis: plt.xlabel('Time')\n• Label Y-Axis: plt.ylabel('Value')\n• Show Legend: plt.legend()"
      },
      {
        name: "Chart Formats",
        content: "• Scatter Plot: plt.scatter(x, y)\n• Bar Chart: plt.bar(categories, heights)\n• Histogram: plt.hist(data, bins=10)\n• Pie Chart: plt.pie(fractions, labels=labels)\n• Grid display: plt.grid(True)"
      },
      {
        name: "Layout & Render",
        content: "• Create figure size: plt.figure(figsize=(width, height))\n• Subplots grid: plt.subplots(rows, cols)\n• Render Canvas: plt.show()\n• Clear active drawing: plt.clf()"
      }
    ]
  },
  math: {
    title: "Math Library (Inbuilt)",
    desc: "Mathematical functions defined by the C standard.",
    sections: [
      {
        name: "Constants",
        content: "• Pi (3.1415...): math.pi\n• Euler's number (2.718...): math.e"
      },
      {
        name: "Numeric Operations",
        content: "• Square root: math.sqrt(x)\n• Power (x^y): math.pow(x, y)\n• Factorial: math.factorial(x)\n• Floor value: math.floor(x)\n• Ceiling value: math.ceil(x)"
      },
      {
        name: "Trigonometry",
        content: "• Sine: math.sin(rad)\n• Cosine: math.cos(rad)\n• Tangent: math.tan(rad)\n• Convert degrees to radians: math.radians(deg)"
      }
    ]
  }
};

export default function DocumentationModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('numpy');

  if (!isOpen) return null;

  const doc = DOCS_DATA[activeTab];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-[500px] glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/50 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-slate-400" />
            <h2 className="font-orbitron text-sm font-bold tracking-widest text-white">DEVSHAALA LIBRARY HELP</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-[180px] bg-slate-950/20 border-r border-white/5 p-3 flex flex-col gap-1">
            {Object.keys(DOCS_DATA).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  activeTab === tab 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="capitalize">{tab}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>

          {/* Docs Content panel */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div>
              <h3 className="text-base font-bold text-white mb-1">{doc.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{doc.desc}</p>
            </div>
            
            <div className="space-y-4">
              {doc.sections.map((section, idx) => (
                <div key={idx} className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Compass className="w-3.5 h-3.5 text-slate-400" />
                    {section.name}
                  </div>
                  <pre className="text-xs font-mono bg-slate-950/30 p-3 rounded-lg text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                    {section.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950/35 border-t border-white/5 text-[10px] text-slate-500 flex items-center gap-1">
          <Terminal className="w-3 h-3" />
          <span>Press ESC or click close to return to the workspace.</span>
        </div>

      </div>
    </div>
  );
}
