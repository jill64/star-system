import { D1 } from 'd1-driver'
import { Branch } from './Branch.js'
import { CFAuthParameter } from './types/CFAuthParameter.js'

export class StarSystem {
  private d1
  private prefix

  constructor(
    params: CFAuthParameter & {
      name: string
    }
  ) {
    this.d1 = new D1(params.accountId, params.apiKey)
    this.prefix = params.name
  }

  async listBranches(): Promise<Branch[]> {
    const res = await this.d1.list({
      name: `${this.prefix}_branch`
    })

    return res.result.map((branch) => new Branch(this.d1, branch))
  }

  async createBranch(name: string): Promise<Branch> {
    const res = await this.d1.create(`${this.prefix}_branch_${name}`)

    if (!res.result) {
      throw new Error('Invalid response')
    }

    return new Branch(this.d1, res.result)
  }
}
