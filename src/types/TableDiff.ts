import { ColumnDiff } from './ColumnDiff.js'
import { IndexDiff } from './IndexDiff.js'
import { Table } from './Table.js'

export type TableDiff = {
  addTables: Table[]
  dropTables: Table[]
  modifyTables: (Table & {
    columnDiff: ColumnDiff
    indexDiff: IndexDiff
  })[]
}
