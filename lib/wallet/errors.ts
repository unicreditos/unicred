/** Error con un mensaje apto para mostrar a la persona (validaciones y reglas de negocio de la billetera). */
export class WalletError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WalletError'
  }
}
