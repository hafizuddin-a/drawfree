export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const readText = (file: Blob): Promise<string> => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result));
  fr.onerror = () => rej(new Error('Could not read that file.'));
  fr.readAsText(file);
});
