import { Column } from './Column.js'

export type ColumnDiff = {
  addColumns: Column[]
  dropColumns: Column[]
  modifyColumns: Column[]
}
