export type IndexKey = {
  seq: number
  name: string
  unique: number
  origin: string
  partial: number
  columns: {
    seqno: number
    cid: number
    name: string
  }[]
}
