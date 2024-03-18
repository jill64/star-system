import { Column } from './Column.js'
import { ColumnDiff } from './ColumnDiff.js'
import { IndexDiff } from './IndexDiff.js'
import { IndexKey } from './IndexKey.js'
import { Table } from './Table.js'

export type TableDiff = {
  addTables: {
    table: Table
    columns: Column[]
    indexes: IndexKey[]
  }[]
  dropTables: Table[]
  modifyTables: (Table & {
    columnDiff: ColumnDiff
    indexDiff: IndexDiff
  })[]
}
