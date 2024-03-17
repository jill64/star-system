import { Branch } from './Branch.js'
import { D1 } from './D1.js'
import { CFAuthParameter } from './types/CFAuthParameter.js'

export class StarSystem {
  private d1
  private prefix

  constructor(
    params: CFAuthParameter & {
      name: string
    }
  ) {
    this.d1 = D1(params)
    this.prefix = params.name
  }

  async listBranches(): Promise<Branch[]> {
    const res = await this.d1.list({
      name: `${this.prefix}_branch`
    })

    return res.result.map(
      (branch) => new Branch(this.d1.prepare(branch.uuid), branch.name)
    )
  }

  async createBranch(name: string): Promise<Branch> {
    const res = await this.d1.create(`${this.prefix}_branch_${name}`)

    return new Branch(this.d1.prepare(res.result.uuid), res.result.name)
  }
}
