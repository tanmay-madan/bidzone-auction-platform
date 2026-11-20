import { Link } from "react-router-dom";
import { Icon } from "../components/ui";

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="num text-sm text-gold">404</p>
      <h1 className="mt-3 font-display text-6xl text-ivory">Page not found</h1>
      <p className="mt-4 max-w-md text-mute">The page you're looking for doesn't exist or may have been moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-gold">
          Go to home
        </Link>
        <Link to="/browse" className="btn-ghost">
          <Icon.Compass className="h-4 w-4" /> Explore auctions
        </Link>
      </div>
    </div>
  );
}
