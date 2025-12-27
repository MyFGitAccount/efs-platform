import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Spin } from 'antd';
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
    loadCourses();
  }, []);

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
      const response = await api.post('/auth/login', {
        email: values.email,
        sid: values.sid,
        password: values.password,
      }, {
      headers: {
        'Content-Type': 'application/json',
      }
     });

      if (response.data.ok) {
        localStorage.setItem('sid', response.data.sid);
        localStorage.setItem('role', response.data.role);
        localStorage.setItem('token', response.data.token);
        
        if (response.data.role === 'admin') {
          navigate('/admin');
          return;
        }

        // Check course
        const courseCode = values.courseCode?.toUpperCase();
        if (courseCode && courses[courseCode]) {
          if (courseCode === 'EIS') {
            navigate('/eis');
          } else {
            navigate(`/courses/${courseCode}`);
          }
        } else {
          setShowCreateCourse(true);
        }
      } else {
        setError(response.data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="glass-card">
        <div className="header">
          <Title level={2} className="gradient-text">Welcome to EFS</Title>
          <Text type="secondary">Enter your course code to get started</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon className="mb-4" />}

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="courseCode"
            label="Course Code"
            rules={[{ required: true, message: 'Please enter course code' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="e.g., AD113, HD101"
              onChange={(e) => {
                const code = e.target.value.toUpperCase();
                if (code && courses[code]) {
                  setShowCreateCourse(false);
                } else if (code.length >= 3) {
                  setShowCreateCourse(true);
                }
              }}
            />
          </Form.Item>

          <div className="login-section">
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Invalid email' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="your@email.com" />
            </Form.Item>

            <Form.Item
              name="sid"
              label="Student ID"
              rules={[{ required: true, message: 'Please enter student ID' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="e.g. 20293303" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" />
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Login
            </Button>
          </Form.Item>

          <div className="text-center mt-4">
            <Button type="link" onClick={() => navigate('/register')}>
              Create Account
            </Button>
          </div>
        </Form>

        {showCreateCourse && (
          <Button
            type="dashed"
            block
            onClick={() => navigate('/courses/new')}
            className="mt-4"
          >
            Create a new course
          </Button>
        )}
      </Card>
    </div>
  );
};

export default Login;
