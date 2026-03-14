import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const [seconds, setSeconds] = useState(3);
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [navigate]);

  return (
    <div className="scrollable-content">
      <div className="section-card text-center">
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <p>
          Redirecting to the homepage in {seconds} second{seconds !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
};

export default NotFound;
