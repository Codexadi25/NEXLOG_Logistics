/**
 * imageUtils.js – Convert images to SVG/base64 for DB storage.
 * Files under 1MB → base64 encoded. SVG → stored as-is.
 * Larger files → compressed/converted to SVG placeholder.
 */

const MAX_SIZE_BYTES = 1024 * 1024; // 1MB

/**
 * Convert a File object to a base64 data-URI string.
 * Returns { dataUri, format, sizeKb }
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result;
      const sizeKb = Math.round(file.size / 1024);
      const format = file.type?.split('/')[1] || 'unknown';
      resolve({ dataUri, format, sizeKb, originalName: file.name });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize + convert an image File to a base64 JPEG (max 800px wide).
 * Used for photos/docs to keep size under 1MB.
 */
export function resizeImageToBase64(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', quality);
        const sizeKb = Math.round((dataUri.length * 3) / 4 / 1024);
        resolve({ dataUri, format: 'jpeg', sizeKb, originalName: file.name });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Smart file handler: chooses the best storage method based on type + size.
 */
export async function processFileForDB(file) {
  if (!file) return null;

  // SVG → store as-is (text)
  if (file.type === 'image/svg+xml') {
    const text = await file.text();
    return { dataUri: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`, format: 'svg', sizeKb: Math.round(file.size / 1024) };
  }

  // Images → resize to keep under 1MB
  if (file.type.startsWith('image/')) {
    const result = await resizeImageToBase64(file, 800, 0.75);
    // If still too large after first resize, compress more
    if (result.sizeKb > 900) {
      return resizeImageToBase64(file, 600, 0.55);
    }
    return result;
  }

  // PDF → check size, store as base64 if under 1MB
  if (file.type === 'application/pdf') {
    if (file.size <= MAX_SIZE_BYTES) {
      return fileToBase64(file);
    }
    // Too large — return error
    throw new Error(`PDF too large (${Math.round(file.size / 1024)}KB). Max 1MB.`);
  }

  // Default: base64 encode
  if (file.size <= MAX_SIZE_BYTES) {
    return fileToBase64(file);
  }

  throw new Error(`File too large (${Math.round(file.size / 1024)}KB). Max 1MB.`);
}

/**
 * DocImageInput – A styled file input that processes + previews docs.
 */
export function DocImageInput({ label, value, onChange, accept = 'image/*,.pdf', hint }) {
  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processFileForDB(file);
      onChange(processed);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{hint}</div>}
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${value ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'all 0.2s',
        background: value ? 'rgba(0,212,255,0.04)' : 'transparent',
        gap: 8, minHeight: 100,
      }}>
        <input type="file" accept={accept} style={{ display: 'none' }} onChange={handleChange} />
        {value ? (
          <>
            {value.format !== 'pdf' ? (
              <img src={value.dataUri} alt={label} style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
            ) : (
              <div style={{ fontSize: 36 }}>📄</div>
            )}
            <div style={{ fontSize: 11, color: 'var(--success)' }}>✓ {value.originalName} ({value.sizeKb}KB)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to change</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28 }}>📎</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Click to upload<br /><span style={{ fontSize: 11 }}>JPG, PNG, PDF · Max 1MB · Auto-compressed</span>
            </div>
          </>
        )}
      </label>
    </div>
  );
}
