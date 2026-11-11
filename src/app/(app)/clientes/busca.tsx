"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icone } from "@/components/icone";

export function BuscaClientes({ inicial }: { inicial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(inicial);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);
  return (
    <div className="ferramentas">
      <div className="busca">
        <Icone nome="lupa" />
        <label htmlFor="busca-clientes" className="oculto">
          Buscar cliente
        </label>
        <input
          id="busca-clientes"
          className="entrada"
          type="search"
          placeholder="Buscar por nome, telefone ou rua"
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (espera.current) clearTimeout(espera.current);
            espera.current = setTimeout(() => router.replace(v.trim() ? `/clientes?q=${encodeURIComponent(v.trim())}` : "/clientes", { scroll: false }), 300);
          }}
        />
      </div>
    </div>
  );
}
