export const token = document.querySelector<HTMLMetaElement>('meta[name="marq-token"]')?.content ?? '';
export const pageID = document.querySelector<HTMLMetaElement>('meta[name="marq-page"]')?.content ?? '';

export type APIError = Error & { status?: number };

export async function api<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/__marqraft/${path}`, data === undefined
    ? { cache: 'no-store', signal }
    : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Marqraft-Session': token }, body: JSON.stringify(data), signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error?.message ?? response.statusText), { status: response.status });
  return body as T;
}

export async function upload(file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
  return (await api<{ url: string }>('upload', { name: file.name, base64 })).url;
}
