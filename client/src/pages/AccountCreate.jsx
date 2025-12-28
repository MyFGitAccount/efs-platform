import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Upload, message, Alert, Image, Spin } from 'antd';
import { UploadOutlined, UserOutlined, LockOutlined, MailOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api'; // Use the centralized API utility
import './AccountCreate.css'; // Optional CSS file

const { Title, Text } = Typography;

const AccountCreate = () => {
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleUpload = (file) => {
    // Validation
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

    setIsUploadingPhoto(true);
    setPhotoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
      setIsUploadingPhoto(false);
    };
    
    reader.onerror = () => {
      message.error('Failed to read file');
      setIsUploadingPhoto(false);
      setPhotoFile(null);
      setPreviewImage('');
    };
    
    reader.readAsDataURL(file);
    
    return false; // Prevent automatic upload
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPreviewImage('');
  };

  const onFinish = async (values) => {
    setLoading(true);
    
    try {
      // Validate photo
      if (!photoFile) {
        message.error('Please upload a photo of your student card');
        setLoading(false);
        return;
      }

      // Convert photo to Base64 if needed
      let photoData = previewImage;
      if (!photoData && photoFile) {
        photoData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
      }

      // Check if student ID already exists
      try {
        const checkResponse = await api.get(`/auth/check/${values.sid}`);
        if (checkResponse.data.exists) {
          message.error('Student ID already exists or is pending approval');
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        console.log('Check API might not be available');
      }

      // Prepare registration data
      const registrationData = {
        sid: values.sid,
        email: values.email.toLowerCase(),
        password: values.password,
        photoData: photoData,
        fileName: `student_card_${values.sid}.jpg`
      };

      // Submit registration
      const response = await api.post('/auth/register', registrationData);

      if (response.data.ok) {
        message.success({
          content: 'Account request submitted successfully! Awaiting admin approval.',
          duration: 5,
        });
        
        // Show additional info
        Alert.info({
          message: 'What happens next?',
          description: 'You will receive an email once your account is approved by the administrator.',
          showIcon: true,
        });
        
        // Reset form
        form.resetFields();
        removePhoto();
        
        // Redirect to login after delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        message.error(response.data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      // Handle specific error cases
      if (err.response) {
        switch (err.response.status) {
          case 400:
            message.error('Missing or invalid information. Please check all fields.');
            break;
          case 409:
            message.error('User already exists or is pending approval.');
            break;
          case 500:
            message.error('Server error. Please try again later.');
            break;
          default:
            message.error(err.response.data?.error || 'Registration failed');
        }
      } else if (err.request) {
        message.error('Network error. Please check your internet connection.');
      } else {
        message.error('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-create-container">
      <Card className="register-card">
        <div className="register-header">
          <Title level={2} className="gradient-text">Create Account</Title>
          <Text type="secondary">Submit your details for admin approval</Text>
        </div>

        <Alert
          message="Important Information"
          description={
            <div>
              <p>Your account requires admin approval before you can log in.</p>
              <p>Please ensure you upload a <strong>clear, legible photo</strong> of your student ID card.</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="sid"
            label="Student ID"
            rules={[
              { required: true, message: 'Please enter your student ID' },
              { 
                pattern: /^[a-zA-Z0-9]{6,}$/, 
                message: 'Student ID must be at least 6 characters (letters/numbers)' 
              }
            ]}
            hasFeedback
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="e.g., 20293303" 
              maxLength={20}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
            hasFeedback
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="your.email@example.com" 
              type="email"
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
            help="Upload a clear photo of your student ID card. Max 2MB. JPG, PNG, or GIF format."
            validateStatus={!photoFile && form.isFieldTouched('photo') ? 'error' : ''}
          >
            <div className="photo-upload-section">
              <Upload
                name="photo"
                listType="picture-card"
                maxCount={1}
                beforeUpload={handleUpload}
                onRemove={removePhoto}
                accept="image/*"
                showUploadList={false}
                disabled={isUploadingPhoto}
              >
                {isUploadingPhoto ? (
                  <div className="upload-loading">
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    <div style={{ marginTop: 8 }}>Processing...</div>
                  </div>
                ) : previewImage ? (
                  <div className="preview-container">
                    <Image
                      src={previewImage}
                      alt="Student card preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      preview={false}
                    />
                    <div className="preview-overlay">
                      <Text style={{ color: 'white' }}>Click to change</Text>
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <UploadOutlined style={{ fontSize: 24 }} />
                    <div style={{ marginTop: 8 }}>Upload Photo</div>
                  </div>
                )}
              </Upload>
              
              {previewImage && (
                <div className="preview-info">
                  <Text type="secondary">✓ Photo ready for upload</Text>
                  <Button 
                    type="link" 
                    danger 
                    onClick={removePhoto}
                    size="small"
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
              size="large"
              disabled={!photoFile}
            >
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </Form.Item>

          <div className="register-footer">
            <Text type="secondary">
              Already have an account?{' '}
              <Button type="link" onClick={() => navigate('/login')}>
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
