import { z } from "zod";

export const DadosClienteZ = z
  .object({
    nome: z.string().max(200),
    telefones: z.array(z.string().max(40)).max(10),
    observacoes: z.string().max(4000).nullable(),
  })
  .strict();

export const EnderecoZ = z
  .object({
    rua: z.string().max(300),
    bairro: z.string().max(200).nullable(),
    cidade: z.string().max(120),
    referencia: z.string().max(1000).nullable(),
  })
  .strict();

export const ModalidadeZ = z
  .object({
    nome: z.string().max(80),
    sufixo: z.string().max(4),
    palavras: z.array(z.string().max(60)).max(60),
    ativa: z.boolean(),
  })
  .strict();

export const CategoriaZ = z.enum(["caixas", "dedet", "desr"]);

export const FORMATO_INVALIDO = { erro: "Algum campo veio num formato inesperado." };
