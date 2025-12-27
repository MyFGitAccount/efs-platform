import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  InputNumber, 
  Button, 
  Select, 
  Row, 
  Col, 
  Typography, 
  Alert, 
  Tag, 
  Upload,
  Avatar,
  Space,
  message
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  PhoneOutlined, 
  BookOutlined,
  UploadOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Profile = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const sid = localStorage.getItem('sid');
      if (!sid) {
        navigate('/login');
        return;
      }

      const response = await axios.get('/api/auth/me', {
        params: { sid }
      });

      if (response.data.ok) {
        const data = response.data.data;
        setUserData(data);
        
        // Set form values
        form.setFieldsValue({
          sid: data.sid,
          email: data.email,
          phone: data.phone || '',
          major: data.major || '',
          gpa: data.gpa || null,
          dse_score: data.dse_score || '',
          year_of_study: data.year_of_study || 1,
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : data.skills || '',
          courses: Array.isArray(data.courses) ? data.courses.join(', ') : data.courses || '',
          about_me: data.about_me || '',
        });

        // Set photo if available
        if (data.photo_path) {
          setPhotoUrl(data.photo_path);
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      message.error('Failed to load profile data');
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const sid = localStorage.getItem('sid');
      const response = await axios.put('/api/profile/update', {
        sid,
        ...values,
        skills: values.skills ? values.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        courses: values.courses ? values.courses.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : [],
      });

      if (response.data.ok) {
        message.success('Profile updated successfully!');
        loadProfile(); // Reload updated data
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      message.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file) => {
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

    setUploading(true);
    
    try {
      const sid = localStorage.getItem('sid');
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('sid', sid);

      const response = await axios.post('/api/profile/upload-photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.ok) {
        message.success('Profile photo updated!');
        // Create local URL for preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoUrl(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Upload error:', err);
      message.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }

    return false; // Prevent automatic upload
  };

  return (
    <div>
      <Title level={2}>
        <UserOutlined /> Profile
      </Title>
      <Text type="secondary">Manage your personal information and preferences</Text>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} md={8}>
          <Card title="Profile Picture" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <Avatar
                size={120}
                src={photoUrl}
                icon={!photoUrl && <UserOutlined />}
                style={{ marginBottom: 16 }}
              />
              <Upload
                name="photo"
                showUploadList={false}
                beforeUpload={handlePhotoUpload}
                accept="image/*"
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploading}
                  disabled={uploading}
                >
                  Upload Photo
                </Button>
              </Upload>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Max 2MB • JPG, PNG, GIF
              </Text>
            </div>

            {userData && (
              <div style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Student ID:</Text>
                  <div>{userData.sid}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Role:</Text>
                  <div>
                    <Tag color={userData.role === 'admin' ? 'red' : 'blue'}>
                      {userData.role || 'user'}
                    </Tag>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Credits:</Text>
                  <div>
                    <Tag color="green">{userData.credits || 0} credits</Tag>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Member Since:</Text>
                  <div>
                    {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title="Personal Information">
            <Form
              form={form}
              onFinish={onFinish}
              layout="vertical"
              size="large"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Student ID"
                    name="sid"
                  >
                    <Input 
                      prefix={<UserOutlined />} 
                      disabled 
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                      { required: true, message: 'Please enter email' },
                      { type: 'email', message: 'Please enter a valid email' }
                    ]}
                  >
                    <Input 
                      prefix={<MailOutlined />} 
                      type="email"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Phone Number"
                    name="phone"
                  >
                    <Input 
                      prefix={<PhoneOutlined />} 
                      placeholder="+852 1234 5678"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Major"
                    name="major"
                  >
                    <Input placeholder="e.g., Computer Science" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="GPA"
                    name="gpa"
                  >
                    <InputNumber 
                      min={0} 
                      max={4} 
                      step={0.1}
                      style={{ width: '100%' }}
                      placeholder="3.5"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="DSE Score"
                    name="dse_score"
                  >
                    <Input placeholder="e.g., 25" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Year of Study"
                    name="year_of_study"
                  >
                    <Select placeholder="Select year">
                      <Option value={1}>Year 1</Option>
                      <Option value={2}>Year 2</Option>
                      <Option value={3}>Year 3</Option>
                      <Option value={4}>Year 4</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Skills (comma separated)"
                name="skills"
                help="e.g., JavaScript, Python, UI Design, Public Speaking"
              >
                <Input placeholder="List your skills separated by commas" />
              </Form.Item>

              <Form.Item
                label="Current Courses (comma separated, course codes)"
                name="courses"
                help="e.g., AD113, HD101, CS101"
              >
                <Input placeholder="AD113, HD101, CS101" />
              </Form.Item>

              <Form.Item
                label="About Me"
                name="about_me"
              >
                <TextArea 
                  rows={4} 
                  placeholder="Tell others about yourself, your study goals, interests, etc."
                  maxLength={500}
                  showCount
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    Save Changes
                  </Button>
                  <Button onClick={() => form.resetFields()}>
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          {/* Additional Info Card */}
          <Card title="Study Information" style={{ marginTop: 24 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div>
                  <Text strong>Preferred Study Times:</Text>
                  <div>
                    <Tag color="blue">Weekday Evenings</Tag>
                    <Tag color="blue">Weekend Mornings</Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>Study Preferences:</Text>
                  <div>
                    <Tag color="green">Group Study</Tag>
                    <Tag color="green">Online Meetings</Tag>
                  </div>
                </div>
              </Col>
            </Row>
            
            <div style={{ marginTop: 16 }}>
              <Button 
                type="link" 
                icon={<BookOutlined />}
                onClick={() => navigate('/group-formation')}
              >
                Update Study Preferences in Group Formation
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;
