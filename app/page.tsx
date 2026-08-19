import Game from "./game";

// Always serve the current deployment shell so clients do not keep loading an
// older hashed game bundle after a roster/content release.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <Game />;
}
