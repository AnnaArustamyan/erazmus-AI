import { API_BASE_URL } from './config'

export interface UploadedFile {
  path: string
  name: string
  size: number
  contentType: string
}

async function parseErrorBody(response: Response): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.error ?? `Upload failed (${response.status})`
}

export async function uploadFile(accessToken: string, file: File): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })

  if (!response.ok) throw new Error(await parseErrorBody(response))
  return response.json()
}
