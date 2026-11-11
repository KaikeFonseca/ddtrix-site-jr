// Gera o hash da senha da conta da empresa para colocar em EMPRESA_SENHA_HASH.
// Uso: npm run senha -- "a senha escolhida"
import { hashSenha } from "../src/lib/senha";

const senha = process.argv[2];
if (!senha || senha.length < 10) {
  console.error('Informe uma senha com pelo menos 10 caracteres: npm run senha -- "minha senha forte"');
  process.exit(1);
}
console.log(hashSenha(senha));
