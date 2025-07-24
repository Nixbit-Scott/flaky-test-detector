import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthFlow: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRegisterSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsLogin(true);
    }, 3000);
  };

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
    return <LoginForm onSwitchToRegister={() => setIsLogin(false)} />;
  }

  return (
    <div>
      <RegisterForm onSuccess={handleRegisterSuccess} />
      <div className="text-center mt-4">
        <button
          onClick={() => setIsLogin(true)}
          className="text-indigo-600 hover:text-indigo-500 text-sm"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
};

export default AuthFlow;