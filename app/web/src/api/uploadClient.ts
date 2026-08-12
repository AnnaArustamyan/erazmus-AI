import { apiFetch, parseErrorBody } from './http'

export interface UploadedFile {
  path: string
  name: string
  size: number
  contentType: string
}

export async function uploadFile(accessToken: string | null, file: File): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiFetch('/api/upload', {
    method: 'POST',
    accessToken,
    body: formData,
  })

  if (!response.ok) throw new Error(await parseErrorBody(response, 'Upload failed'))
  return response.json()
}
