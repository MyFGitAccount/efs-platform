import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import api from '../utils/api';
import './Login.css';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState({});
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load courses for course validation
    loadCourses();
    
    // Check if user is already logged in
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sid = localStorage.getItem('sid');
      if (sid) {
        const response = await api.get('/auth/session', {
          params: { sid }
        });
        
        if (response.data.ok && response.data.authenticated) {
          // User is already logged in, redirect based on role
          if (response.data.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }
      }
    } catch (err) {
      console.error('Session check failed:', err);
      // Clear invalid session
      localStorage.clear();
    }
  };

  const loadCourses = async () => {
    try {
      const response = await api.get('/courses');
      if (response.data.ok) {
        setCourses(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    
    try {
      // Validate course code if provided
      const courseCode = values.courseCode?.toUpperCase();
      if (courseCode && courseCode.length > 0) {
        const courseExists = courses[courseCode];
        if (!courseExists) {
          setError(`Course "${courseCode}" does not exist. Please check the course code or contact administrator.`);
          setLoading(false);
          return;
        }
      }
      
      const response = await api.post('/auth/login', {
        email: values.email,
        sid: values.sid,
        password: values.password,
      });

      if (response.data.ok) {
        // Store user session
        localStorage.setItem('sid', response.data.sid);
        localStorage.setItem('email', response.data.email);
        localStorage.setItem('role', response.data.role || 'user');
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('credits', response.data.credits || 0);
        
        message.success('Login successful!');
        
        // Redirect based on user role
        if (response.data.role === 'admin') {
          navigate('/admin');
        } else {
          // Always go to dashboard first, then user can navigate to specific course
          navigate('/dashboard');
        }
      } else {
        setError(response.data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Handle different error types
      if (err.response) {
        switch (err.response.status) {
          case 400:
            setError('Missing credentials. Please fill in all fields.');
            break;
          case 401:
            setError('Invalid email, student ID or password. Please try again.');
            break;
          case 404:
            setError('User not found. Please check your credentials or register first.');
            break;
          case 500:
            setError('Server error. Please try again later.');
            break;
          default:
            setError(err.response.data?.error || 'Login failed. Please try again.');
        }
      } else if (err.request) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCourseCodeChange = (e) => {
    const code = e.target.value.toUpperCase();
    
    // Show create course option only if course doesn't exist
    if (code && code.length >= 2) {
      const courseExists = courses[code];
      setShowCreateCourse(!courseExists && code.length >= 3);
    } else {
      setShowCreateCourse(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="glass-card">
        <div className="header">
          <Title level={2} className="gradient-text">Welcome to EFS Platform</Title>
          <Text type="secondary">Education For Success - Student Learning Platform</Text>
        </div>

        {error && (
          <Alert 
            message={error} 
            type="error" 
            showIcon 
            className="mb-4"
            closable
            onClose={() => setError('')}
          />
        )}

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          initialValues={{
            courseCode: '',
            email: '',
            sid: '',
            password: ''
          }}
        >
          <Form.Item
            name="courseCode"
            label="Course Code (Optional)"
            help="Enter if you want to go directly to a specific course"
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="e.g., AD113, HD101"
              onChange={handleCourseCodeChange}
              allowClear
            />
          </Form.Item>

          <div className="divider">
            <Text type="secondary">Account Information</Text>
          </div>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { 
                type: 'email', 
                message: 'Please enter a valid email address' 
              }
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="student@example.com" 
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="sid"
            label="Student ID"
            rules={[
              { required: true, message: 'Please enter your student ID' },
              { 
                pattern: /^[a-zA-Z0-9]+$/,
                message: 'Student ID can only contain letters and numbers'
              }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="e.g., 20293303" 
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password' },
              { 
                min: 6, 
                message: 'Password must be at least 6 characters' 
              }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Enter your password" 
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
              size="large"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </Form.Item>

          <div className="login-footer">
            <div className="links">
              <Link to="/register" className="link-item">
                Create New Account
              </Link>
              <span className="separator">•</span>
              <Link to="/forgot-password" className="link-item">
                Forgot Password?
              </Link>
            </div>
            
            <div className="demo-info">
              <Text type="secondary">
                Demo Admin: admin@efs.com / admin123
              </Text>
            </div>
          </div>
        </Form>

        {showCreateCourse && (
          <div className="create-course-prompt">
            <Alert
              message="Course Not Found"
              description={
                <div>
                  <Text>Course code doesn't exist. Would you like to:</Text>
                  <div className="actions">
                    <Button 
                      type="link" 
                      onClick={() => navigate('/courses/request')}
                      className="action-btn"
                    >
                      Request Course Creation
                    </Button>
                    <Button 
                      type="link" 
                      onClick={() => setShowCreateCourse(false)}
                      className="action-btn"
                    >
                      Continue to Dashboard
                    </Button>
                  </div>
                </div>
              }
              type="warning"
              showIcon
            />
          </div>
        )}
      </Card>
      
      <div className="login-info">
        <Card size="small">
          <Text type="secondary">
            <strong>Note:</strong> First-time users must register first. 
            After registration, wait for admin approval before logging in.
          </Text>
        </Card>
      </div>
    </div>
  );
};

export default Login;
