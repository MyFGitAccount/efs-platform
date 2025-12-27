import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Upload, message, Alert } from 'antd';
import { UploadOutlined, UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;

const AccountCreate = () => {
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const navigate = useNavigate();

  const handleUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return false;
    }
    
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
      return false;
    }

    setPhotoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);
    
    return false; // Prevent automatic upload
  };

  const onFinish = async (values) => {
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('sid', values.sid);
      formData.append('email', values.email);
      formData.append('password', values.password);
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await axios.post('/api/auth/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.ok) {
        message.success('Account request submitted! Awaiting admin approval.');
        navigate('/login');
      } else {
        message.error(response.data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      message.error(err.response?.data?.error || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-create-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a2e 50%, #16213e 100%)',
      padding: '20px'
    }}>
      <Card style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>Create Account</Title>
          <Text type="secondary">Submit your details for admin approval</Text>
        </div>

        <Alert
          message="Important Information"
          description="Your account requires admin approval before you can log in. Please upload a clear photo of your student card."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="sid"
            label="Student ID"
            rules={[
              { required: true, message: 'Please enter your student ID' },
              { pattern: /^[0-9]{8,}$/, message: 'Please enter a valid student ID' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="e.g., 20293303" 
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="your.email@example.com" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
            hasFeedback
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Create a strong password" 
            />
          </Form.Item>

          <Form.Item
            name="confirm"
            label="Confirm Password"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Confirm your password" 
            />
          </Form.Item>

          <Form.Item
            label="Student Card Photo"
            required
            extra="Upload a clear photo of your student ID card (max 2MB)"
          >
            <Upload
              name="photo"
              listType="picture"
              maxCount={1}
              beforeUpload={handleUpload}
              onRemove={() => {
                setPhotoFile(null);
                setPreviewImage('');
              }}
            >
              <Button icon={<UploadOutlined />}>Select Photo</Button>
            </Upload>
            
            {previewImage && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img 
                  src={previewImage} 
                  alt="Preview" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: 200, 
                    borderRadius: 8,
                    border: '1px solid #d9d9d9'
                  }} 
                />
              </div>
            )}
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Submit for Approval
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary">
              Already have an account?{' '}
              <Button type="link" onClick={() => navigate('/login')} style={{ padding: 0 }}>
                Login here
              </Button>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default AccountCreate;
