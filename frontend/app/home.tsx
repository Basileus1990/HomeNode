import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <>
      <Link to="host/">Strona hosta</Link>
      <br/>
      <Link to="client/">Strona klienta</Link>
    </>
  );
}
