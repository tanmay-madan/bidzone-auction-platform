import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { Icon } from "./ui";

const MAX_INPUT_BYTES = 15 * 1024 * 1024; // what the user may pick
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // what the API accepts
const MAX_SIDE = 1600; // longest edge after resizing

// Resize and re-encode in the browser so uploads are small and fast
// (a 6 MB phone photo usually becomes ~200 KB). Drawing to a canvas also
// strips metadata such as GPS location.
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // JPEG has no transparency
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const quality of [0.85, 0.75, 0.6]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error("too-large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoUpload({ value, onChange, onBusyChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | processing | uploading | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [localPreview, setLocalPreview] = useState(null);
  const [showLink, setShowLink] = useState(false);

  const busy = status === "processing" || status === "uploading";
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => localPreview && URL.revokeObjectURL(localPreview), [localPreview]);

  async function handleFile(file) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setError("That file isn't an image. Choose a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setStatus("error");
      setError("That photo is larger than 15 MB. Please choose a smaller one.");
      return;
    }

    setLocalPreview(URL.createObjectURL(file));
    setStatus("processing");
    setProgress(0);
    try {
      const blob = await compressImage(file);
      setStatus("uploading");
      const res = await api.post("/images", blob, {
        headers: { "Content-Type": "image/jpeg" },
        timeout: 60000,
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      onChange(res.data.url);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setLocalPreview(null);
      if (err.message === "unreadable") setError("This photo format can't be read here. Try a JPEG or PNG.");
      else if (err.message === "too-large") setError("This photo is too detailed to upload. Try a smaller one.");
      else setError(err.response?.data?.message || "Upload failed. Check your connection and try again.");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function remove() {
    onChange("");
    setLocalPreview(null);
    setStatus("idle");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const preview = localPreview || value;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="group relative overflow-hidden rounded-xl border border-line">
          <img src={preview} alt="Listing photo preview" className="aspect-[16/10] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[2px]">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-sm font-medium text-white">
                {status === "processing" ? "Optimising photo…" : `Uploading ${progress}%`}
              </p>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[#F2B544] transition-all duration-200"
                  style={{ width: `${status === "processing" ? 15 : Math.max(15, progress)}%` }}
                />
              </div>
            </div>
          )}

          {!busy && (
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
              <span className="chip-glass inline-flex items-center gap-1.5 px-2.5 py-1 text-xs">
                <Icon.Check className="h-3.5 w-3.5 text-[#3DDC97]" /> Photo added
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => inputRef.current?.click()} className="chip-glass px-3 py-1.5 text-xs font-medium transition hover:bg-black/60">
                  Replace
                </button>
                <button type="button" onClick={remove} className="chip-glass px-3 py-1.5 text-xs font-medium text-[#FFB4A8] transition hover:bg-black/60">
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? "scale-[1.01] border-gold bg-gold/10" : "border-line-strong bg-night-800/30 hover:border-gold/50 hover:bg-gold/5"
          }`}
        >
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${dragging ? "border-gold bg-gold/20 text-gold" : "border-gold/30 bg-gold/10 text-gold"}`}>
            <Icon.Upload className={`h-6 w-6 transition-transform ${dragging ? "-translate-y-0.5" : ""}`} />
          </span>
          <span>
            <span className="block font-medium text-ivory">
              <span className="hidden sm:inline">{dragging ? "Drop your photo here" : "Drag a photo here or click to browse"}</span>
              <span className="sm:hidden">Tap to take or choose a photo</span>
            </span>
            <span className="mt-1 block text-xs text-mute">JPEG, PNG or WebP up to 15 MB. We optimise it for you.</span>
          </span>
        </button>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-live">
          <Icon.Alert className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {!preview && (
        <div className="mt-3">
          {showLink ? (
            <input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="input"
            />
          ) : (
            <button type="button" onClick={() => setShowLink(true)} className="text-xs text-mute underline-offset-4 hover:text-gold hover:underline">
              Or use an image link instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
