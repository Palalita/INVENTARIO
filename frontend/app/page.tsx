// Ruta raíz ("/"): en la práctica nunca se ve. El middleware (ver
// middleware.ts) redirige "/" a /dashboard o /login en el servidor, antes de
// que este componente llegue a renderizar. Existe solo como fallback por si
// el middleware no llegara a interceptar la request.
export default function Home() {
  return null;
}
