import ka153Form from './ka153-you-2026-form.json' with { type: 'json' }
import { formSchemaToGraph, type FormSchema } from './formSchemaToGraph'

export const ka153FormSchema = ka153Form as FormSchema
export const ka153Graph = formSchemaToGraph(ka153FormSchema)
