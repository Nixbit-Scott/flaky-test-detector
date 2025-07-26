import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthFlow: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Determine if we should show login or register based on the current path
  const isLogin = location.pathname === '/login';

  const handleRegisterSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      navigate('/login');
    }, 3000);
  };

  const switchToRegister = () => {
    navigate('/register');
  };

  const switchToLogin = () => {
    navigate('/login');
  };

  // If neither login nor register, default to login
  useEffect(() => {
    if (location.pathname !== '/login' && location.pathname !== '/register') {
      navigate('/login', { replace: true });
    }
  }, [location.pathname, navigate]);

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            Account created successfully! Redirecting to login...
          </div>
        </div>
      </div>
    );
  }

  if (isLogin) {
    return <LoginForm onSwitchToRegister={switchToRegister} />;
  }

  return (
    <div>
      <RegisterForm onSuccess={handleRegisterSuccess} />
      <div className="text-center mt-4">
        <button
          onClick={switchToLogin}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
};

export default AuthFlow;