"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (files.length === 0) return;
    setLoading(true);
    setResults(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults(JSON.stringify(data, null, 2));
    } catch (err) {
      setResults(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-clear-water"
          style={{ fontFamily: "'Collier', Georgia, serif" }}
        >
          Upload Data
        </h1>
        <p className="text-gray-600 mt-1" style={{ fontFamily: "'Dax Pro', sans-serif" }}>
          Upload FUB export CSVs (deals, calls, texts, appointments) or a generic agent metrics file
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Files</CardTitle>
        </CardHeader>

        <div
          className="border-2 border-dashed border-pearl-aqua/40 rounded-xl p-8 text-center hover:border-clear-water/60 transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = Array.from(e.dataTransfer.files);
            setFiles((prev) => [...prev, ...dropped]);
          }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ".csv,.json";
            input.onchange = () => {
              if (input.files) {
                setFiles((prev) => [...prev, ...Array.from(input.files!)]);
              }
            };
            input.click();
          }}
        >
          <div className="text-clear-water mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Dax Pro', sans-serif" }}>
            <span className="font-medium text-clear-water">Click to upload</span>{" "}
            or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">CSV or JSON files</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-sandy-shore-mid rounded-lg px-4 py-2">
                <span className="text-sm truncate">{f.name}</span>
                <button
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="text-status-red text-sm hover:underline ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={handleUpload}
              disabled={loading}
              className="w-full mt-4 bg-clear-water text-white rounded-xl py-3 font-medium hover:bg-clear-water-dark transition-colors disabled:opacity-50"
              style={{ fontFamily: "'Dax Pro', sans-serif" }}
            >
              {loading ? "Processing..." : "Upload & Ingest"}
            </button>
          </div>
        )}

        {results && (
          <pre className="mt-4 bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-96">
            {results}
          </pre>
        )}
      </Card>
    </div>
  );
}
