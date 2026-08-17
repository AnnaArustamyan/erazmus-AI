import { ka121Graph } from './ka121'
import { ka122Graph } from './ka122'
import { ka131Graph } from './ka131'
import { kaYouthGraph } from './kaYouth'
import { ka210Graph } from './ka210'
import { ka220Graph } from './ka220'
import type { QuestionGraph } from '../types'

export const QUESTION_GRAPHS: Record<string, QuestionGraph> = {
  KA121: ka121Graph,
  KA122: ka122Graph,
  'KA131/171': ka131Graph,
  'KA152-154': kaYouthGraph,
  KA210: ka210Graph,
  KA220: ka220Graph,
}
