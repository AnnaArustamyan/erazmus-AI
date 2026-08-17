import type { ActionType } from './types'

export const ACTION_TYPES: ActionType[] = [
  {
    code: 'KA121',
    group: 'KA1',
    name: 'Accredited mobility',
    description: 'Mobility for organisations that already hold Erasmus accreditation.',
    audience: 'Accredited schools, VET and adult-education providers',
    supported: true,
  },
  {
    code: 'KA122',
    group: 'KA1',
    name: 'Short-term mobility projects',
    description: 'One-off mobility projects for staff and learners. No accreditation required.',
    audience: 'Schools, adult education and VET providers',
    supported: true,
  },
  {
    code: 'KA131/171',
    group: 'KA1',
    name: 'Higher education mobility',
    description: 'Student and staff mobility between higher education institutions.',
    audience: 'Universities and higher education institutions',
    supported: true,
  },
  {
    code: 'KA152-154',
    group: 'KA1',
    name: 'Youth mobility',
    description: 'Youth exchanges, youth-worker mobility, and youth participation.',
    audience: 'Youth organisations',
    supported: true,
  },
  {
    code: 'KA210',
    group: 'KA2',
    name: 'Small-scale partnerships',
    description: 'Lighter-touch cooperation for newcomers and smaller organisations.',
    audience: 'Grassroots organisations and first-time applicants',
    supported: true,
  },
  {
    code: 'KA220',
    group: 'KA2',
    name: 'Cooperation partnerships',
    description: 'Larger transnational partnerships building shared practices and outputs.',
    audience: 'Established organisations with prior EU project experience',
    supported: true,
  },
]

export function getActionType(code: string): ActionType | undefined {
  return ACTION_TYPES.find((action) => action.code === code)
}
