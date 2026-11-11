import { describe, expect, it } from "vitest";
import { conferirSenha, hashSenha } from "./senha";

describe("senha", () => {
  it("confere a senha certa e recusa a errada", () => {
    const hash = hashSenha("uma senha bem forte");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(conferirSenha("uma senha bem forte", hash)).toBe(true);
    expect(conferirSenha("outra senha", hash)).toBe(false);
  });

  it("recusa hash em formato desconhecido", () => {
    expect(conferirSenha("x", "md5:abc")).toBe(false);
    expect(conferirSenha("x", "")).toBe(false);
  });
});
