import { IndexKey } from './IndexKey.js'

export type IndexDiff = {
  addIndexes: IndexKey[]
  dropIndexes: IndexKey[]
}
