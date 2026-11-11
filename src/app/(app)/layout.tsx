import { Casca } from "@/components/casca";
import { quemEsta } from "@/lib/quem-servidor";

export default async function LayoutDoSistema({ children }: { children: React.ReactNode }) {
  const quem = await quemEsta();
  return <Casca quem={quem}>{children}</Casca>;
}
