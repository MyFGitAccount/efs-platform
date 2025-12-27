import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import './App.css';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CourseViewer from './pages/CourseViewer';
import CourseEditor from './pages/CourseEditor';
//import EISViewer from './pages/EISViewer';
import AdminPanel from './pages/AdminPanel';
import AccountCreate from './pages/AccountCreate';
import GroupFormation from './pages/GroupFormation';
import Questionnaire from './pages/Questionnaire';
import Calendar from './pages/Calendar';
import Profile from './pages/Profile';
import Materials from './pages/Materials';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('sid');
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Admin Route component
const AdminRoute = ({ children }) => {
  const isAdmin = localStorage.getItem('role') === 'admin';
  return isAdmin ? children : <Navigate to="/dashboard" />;
};

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 8,
        },
      }}
    >
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<AccountCreate />} />
          
          <Route element={<MainLayout />}>
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/courses/:code" element={
              <ProtectedRoute>
                <CourseViewer />
              </ProtectedRoute>
            } />
            <Route path="/courses/new" element={
              <ProtectedRoute>
                <CourseEditor />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            <Route path="/group-formation" element={
              <ProtectedRoute>
                <GroupFormation />
              </ProtectedRoute>
            } />
            <Route path="/questionnaire" element={
              <ProtectedRoute>
                <Questionnaire />
              </ProtectedRoute>
            } />
            <Route path="/materials" element={
              <ProtectedRoute>
                <Materials />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
