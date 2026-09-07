import type { ActionType } from './types'
import { isActionSupported } from './schemas/registry'

type ActionTypeDefinition = Omit<ActionType, 'supported'>

const ACTION_TYPE_DEFINITIONS: ActionTypeDefinition[] = [
  {
    code: 'KA121',
    group: 'KA1',
    name: 'Accredited mobility',
    description: 'Mobility for organisations that already hold Erasmus accreditation.',
    audience: 'Accredited schools, VET and adult-education providers',
  },
  {
    code: 'KA122',
    group: 'KA1',
    name: 'Short-term mobility projects',
    description: 'One-off mobility projects for staff and learners. No accreditation required.',
    audience: 'Schools, adult education and VET providers',
  },
  {
    code: 'KA131/171',
    group: 'KA1',
    name: 'Higher education mobility',
    description: 'Student and staff mobility between higher education institutions.',
    audience: 'Universities and higher education institutions',
  },
  {
    code: 'KA152',
    group: 'KA1',
    name: 'Youth exchanges',
    description: 'Mobility of young people. Participants are young people, not youth workers.',
    audience: 'Youth organisations running exchanges',
  },
  {
    code: 'KA153',
    group: 'KA1',
    name: 'Mobility of youth workers',
    description: 'Professional development of youth workers and their organisations.',
    audience: 'Youth organisations and youth-work providers',
  },
  {
    code: 'KA154',
    group: 'KA1',
    name: 'Youth participation activities',
    description: 'Activities that help young people participate in democratic life.',
    audience: 'Youth organisations and informal groups of young people',
  },
  {
    code: 'KA210',
    group: 'KA2',
    name: 'Small-scale partnerships',
    description: 'Lighter-touch cooperation for newcomers and smaller organisations.',
    audience: 'Grassroots organisations and first-time applicants',
  },
  {
    code: 'KA220',
    group: 'KA2',
    name: 'Cooperation partnerships',
    description: 'Larger transnational partnerships building shared practices and outputs.',
    audience: 'Established organisations with prior EU project experience',
  },
]

// `supported` is never hand-set — it comes from the schema manifest (registry.ts),
// so an action is only clickable once a reviewed schema actually backs it.
export const ACTION_TYPES: ActionType[] = ACTION_TYPE_DEFINITIONS.map((action) => ({
  ...action,
  supported: isActionSupported(action.code),
}))

export function getActionType(code: string): ActionType | undefined {
  return ACTION_TYPES.find((action) => action.code === code)
}
