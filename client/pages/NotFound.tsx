import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A0D12] p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#FFE699] mb-4">404</h1>
        <p className="text-2xl text-white mb-4">Page Not Found</p>
        <p className="text-gray-400 mb-8 max-w-md">
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>
        <Link
          to="/dashboard"
          className="btn-gold inline-block"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
