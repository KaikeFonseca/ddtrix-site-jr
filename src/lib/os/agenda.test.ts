import { describe, expect, it } from "vitest";
import { classificarServico, interpretarAgenda, lerData, lerEndereco, lerHora, lerPagamento } from "./agenda";

const HOJE = { dia: 10, mes: 11, ano: 2026 }; // terça-feira

// Agenda real enviada pelo dono (dados anonimizados).
const AGENDA_EDUARDA = `EDUARDA:
AGENDA (Quarta-Feira) 11/11
1.
· 📅 DATA: 11/11/2026
· 👤 CLIENTE: Pedro Luiz Silva Pinto
· 📍 SERVIÇO: Limpeza de caixa D'água
· 🚗 LOCAL: Av. Italia, 277, parque Monte Bianco, Aracoiaba da Serra. Números salteados na Av. Itália. Referência: passando o lago, segundo quarteirão a esquerda. Chácara de esquina com a rua Imola.
· ⏰ HORÁRIO APROXIMADO: 09Hrs
2.
· 📆 DATA: 11/11/2026
· 👤 CLIENTE: Condomínio Portal do Ipanema
· 📍 SERVIÇO: Dedetização Completa/Desratização Mensal
· 🚗 LOCAL: Avenida Ipanema, 6055 - Jd Novo Horizonte
· ⏰ HORÁRIO APROXIMADO: 09Hrs
· Nota: Quando verificar os dispositivos de desratização, conferir se não estão em lugares que facilitam para virar e espalhar; cliente se queixou de ter achado muitos venenos fora e em volta dos dispositivos.
3.
· 📅 DATA: 11/11/2026
· 👤 CLIENTE: Cond. Residencial Vista Ipanema
· 📍 SERVIÇO: Dedetização Simples/Desratização Mensal
· 🚗 LOCAL: R. Nelson De Gennaro, 654 - Lot. Dinora Rosa
· ⏰ HORÁRIO APROXIMADO: 11Hrs
4.
· 📅 DATA: 11/11/2026
· 👤 CLIENTE: Condomínio Mirante Ipanema
· 📍 SERVIÇO: Dedetização Completa/Desratização Mensal
· 🚗 LOCAL: Rua Seraphim Banietti, 640 – Caguassu
· ⏰ HORÁRIO APROXIMADO: 14:30Hrs
5.
· 📅 DATA: 11/11/2026
· 👤 CLIENTE: Marcus Souza 1234
· 📍 SERVIÇO: Dedetização foco (escorpião)
· 🚗 LOCAL: Rua sarapu Banirei, 862 – jardim Simus
· ⏰ HORÁRIO APROXIMADO: 16:15Hrs
· 💰 Preço: R$ 450 reais cartão débito`;

describe("agenda da Eduarda", () => {
  const r = interpretarAgenda(AGENDA_EDUARDA, { hoje: HOJE });

  it("separa os 5 atendimentos", () => {
    expect(r).toHaveLength(5);
    expect(r.map((a) => a.cliente)).toEqual([
      "Pedro Luiz Silva Pinto",
      "Condomínio Portal do Ipanema",
      "Cond. Residencial Vista Ipanema",
      "Condomínio Mirante Ipanema",
      "Marcus Souza 1234",
    ]);
  });

  it("lê datas e horários", () => {
    expect(r.every((a) => a.data === "11/11/2026")).toBe(true);
    expect(r.map((a) => a.hora)).toEqual(["09:00", "09:00", "11:00", "14:30", "16:15"]);
  });

  it("classifica serviços e mantém o texto exato", () => {
    expect(r.map((a) => [a.categoria, a.sufixo])).toEqual([
      ["caixas", "CX"],
      ["dedet", "DD"],
      ["dedet", "DD"],
      ["dedet", "DD"],
      ["dedet", "DD"],
    ]);
    expect(r[1].servico).toBe("Dedetização Completa/Desratização Mensal");
  });

  it("separa endereço de referência sem perder texto", () => {
    expect(r[0].rua).toBe("Av. Italia, 277");
    expect(r[0].bairro).toBe("parque Monte Bianco");
    expect(r[0].cidade).toBe("Aracoiaba da Serra/SP");
    expect(r[0].observacoes).toEqual([
      "Números salteados na Av. Itália. Referência: passando o lago, segundo quarteirão a esquerda. Chácara de esquina com a rua Imola.",
    ]);
    expect(r[1].rua).toBe("Avenida Ipanema, 6055");
    expect(r[1].bairro).toBe("Jd Novo Horizonte");
    expect(r[1].cidade).toBe("Sorocaba/SP");
    expect(r[2].rua).toBe("R. Nelson De Gennaro, 654");
    expect(r[2].bairro).toBe("Lot. Dinora Rosa");
    expect(r[3].bairro).toBe("Caguassu");
  });

  it("preserva a nota inteira", () => {
    expect(r[1].observacoes).toEqual([
      "Quando verificar os dispositivos de desratização, conferir se não estão em lugares que facilitam para virar e espalhar; cliente se queixou de ter achado muitos venenos fora e em volta dos dispositivos.",
    ]);
  });

  it("lê o pagamento com cartão", () => {
    expect(r[4].pagamento).toEqual({ forma: "Cartão de débito", valor: "R$ 450", maquininha: true });
    expect(r[0].pagamento).toBeNull();
  });

  it("aponta pendência no nome com números e nada nos completos", () => {
    expect(r[4].pendencias.some((p) => p.includes("Confira o nome"))).toBe(true);
    expect(r[1].pendencias).toEqual([]);
    expect(r[2].pendencias).toEqual([]);
  });

  it("guarda a origem de cada campo", () => {
    expect(r[0].origem.hora).toBe("09Hrs");
    expect(r[0].origem.servico).toBe("Limpeza de caixa D'água");
  });
});

describe("campos soltos", () => {
  it("horários", () => {
    expect(lerHora("14h30").hora).toBe("14:30");
    expect(lerHora("às 8").hora).toBe("08:00");
    expect(lerHora("8:05").hora).toBe("08:05");
    expect(lerHora("Tarde")).toEqual({ hora: "Tarde", vaga: true });
    expect(lerHora("de manhã").vaga).toBe(true);
    expect(lerHora("sem horário").hora).toBeNull();
  });

  it("datas relativas a partir de hoje", () => {
    expect(lerData("amanhã", HOJE)).toBe("11/11/2026");
    expect(lerData("hoje", HOJE)).toBe("10/11/2026");
    expect(lerData("sexta", HOJE)).toBe("13/11/2026");
    expect(lerData("terça", HOJE)).toBe("10/11/2026");
    expect(lerData("5/1", HOJE)).toBe("05/01/2026");
    expect(lerData("05/01/27", HOJE)).toBe("05/01/2027");
  });

  it("categorias", () => {
    expect(classificarServico("Dedetização/Desratização")).toEqual({ categoria: "dedet", sufixo: "DD" });
    expect(classificarServico("Desratização")).toEqual({ categoria: "desr", sufixo: "DR" });
    expect(classificarServico("Limpeza de caixa de gordura")).toEqual({ categoria: "caixas", sufixo: "GX" });
    expect(classificarServico("Limpeza de caixa de esgoto")).toEqual({ categoria: "caixas", sufixo: "EG" });
    expect(classificarServico("Limpeza de fossa")).toEqual({ categoria: "caixas", sufixo: "FS" });
    expect(classificarServico("Limpeza de caixa")).toEqual({ categoria: "caixas", sufixo: "CX" });
    expect(classificarServico("limpeza")).toBeNull();
  });

  it("pagamentos", () => {
    expect(lerPagamento("cartão")).toEqual({ forma: "Cartão", valor: null, maquininha: true });
    expect(lerPagamento("R$ 200,00 no pix")).toEqual({ forma: "Pix", valor: "R$ 200,00", maquininha: false });
    expect(lerPagamento("dinheiro")).toMatchObject({ forma: "Dinheiro", maquininha: false });
    expect(lerPagamento("R$ 300")).toEqual({ forma: null, valor: "R$ 300", maquininha: false });
  });

  it("endereços em formatos diferentes", () => {
    expect(lerEndereco("Rua das Flores 120, Vila Hortência", "Sorocaba/SP")).toMatchObject({ rua: "Rua das Flores, 120", bairro: "Vila Hortência", cidade: "Sorocaba/SP" });
    expect(lerEndereco("Rua X, nº 15 - Centro - Votorantim", "Sorocaba/SP")).toMatchObject({ rua: "Rua X, 15", bairro: "Centro", cidade: "Votorantim/SP" });
    expect(lerEndereco("Rua Y, 10, Sorocaba", "Sorocaba/SP")).toMatchObject({ rua: "Rua Y, 10", bairro: null, cidade: "Sorocaba/SP" });
    expect(lerEndereco("Estrada do Ipanema sem número", "Sorocaba/SP").temNumero).toBe(false);
  });
});

describe("outros formatos", () => {
  it("sem numeração, separa pelo rótulo repetido e usa datas relativas", () => {
    const t = `Cliente: Ana Paula\nServiço: limpeza de caixa d'água\nLocal: Rua A, 10 - Centro\nHorário: 8h\nData: amanhã\n\nCliente: João\nServiço: desratização\nLocal: Rua B, 20 - Éden\nHorário: tarde\nData: amanhã\nPagamento: pix`;
    const r = interpretarAgenda(t, { hoje: HOJE });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ cliente: "Ana Paula", data: "11/11/2026", hora: "08:00", categoria: "caixas" });
    expect(r[1]).toMatchObject({ cliente: "João", hora: "tarde", categoria: "desr", pagamento: { forma: "Pix" } });
  });

  it("aceita prefixos do WhatsApp e não inventa campos ausentes", () => {
    const t = `[11/11 08:32] Eduarda: 1. Cliente: Maria\n[11/11 08:32] Eduarda: Serviço: dedetização`;
    const [a] = interpretarAgenda(t, { hoje: HOJE });
    expect(a.cliente).toBe("Maria");
    expect(a.hora).toBeNull();
    expect(a.rua).toBeNull();
    expect(a.pendencias).toEqual(expect.arrayContaining(["Horário não encontrado.", "Endereço não encontrado.", "Data não encontrada."]));
  });

  it("dados contraditórios viram pergunta", () => {
    const t = `1.\nCliente: Maria\nHorário: 9h\nHorário: 10h`;
    const [a] = interpretarAgenda(t, { hoje: HOJE });
    expect(a.pendencias.some((p) => p.includes("horários diferentes"))).toBe(true);
  });
});
