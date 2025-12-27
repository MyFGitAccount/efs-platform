import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Upload,
  message,
  Badge,
  Avatar,
  Tooltip,
  Progress,
  Empty,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FilterOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import './Materials.css';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Dragger } = Upload;

const Materials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [sortBy, setSortBy] = useState('uploadedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [courses, setCourses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const fileTypeIcons = {
    'pdf': <FilePdfOutlined style={{ color: '#f40' }} />,
    'doc': <FileWordOutlined style={{ color: '#2b579a' }} />,
    'docx': <FileWordOutlined style={{ color: '#2b579a' }} />,
    'xls': <FileExcelOutlined style={{ color: '#217346' }} />,
    'xlsx': <FileExcelOutlined style={{ color: '#217346' }} />,
    'ppt': <FilePptOutlined style={{ color: '#d24726' }} />,
    'pptx': <FilePptOutlined style={{ color: '#d24726' }} />,
    'jpg': <FileImageOutlined style={{ color: '#d32f2f' }} />,
    'jpeg': <FileImageOutlined style={{ color: '#d32f2f' }} />,
    'png': <FileImageOutlined style={{ color: '#1976d2' }} />,
    'gif': <FileImageOutlined style={{ color: '#388e3c' }} />,
    'txt': <FileTextOutlined style={{ color: '#757575' }} />,
  };

  useEffect(() => {
    loadMaterials();
    loadCourses();
  }, [filterCourse, sortBy, sortOrder]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/materials/search', {
        params: {
          q: searchTerm,
          course: filterCourse,
          sortBy,
          sortOrder,
        }
      });

      if (response.data.ok) {
        setMaterials(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load materials:', err);
      message.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await axios.get('/api/courses');
      if (response.data.ok) {
        const courseList = Object.entries(response.data.data).map(([code, title]) => ({
          code,
          title,
        }));
        setCourses(courseList);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    return fileTypeIcons[extension] || <FileOutlined />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = async (material) => {
    try {
      const link = document.createElement('a');
      link.href = `/api/materials/download/${material._id}`;
      link.download = material.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update download count in UI
      setMaterials(prev => prev.map(m =>
        m._id === material._id
          ? { ...m, downloads: m.downloads + 1 }
          : m
      ));

      message.success('Download started');
    } catch (err) {
      console.error('Download failed:', err);
      message.error('Failed to download file');
    }
  };

  const handleUpload = async (file) => {
    setSelectedFile(file);
    return false; // Prevent default upload
  };

  const submitUpload = async () => {
    if (!selectedFile) {
      message.warning('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', selectedFile.name);
    formData.append('description', 'Uploaded material');
    if (filterCourse) {
      formData.append('courseCode', filterCourse);
    }

    try {
      setUploading(true);
      const sid = localStorage.getItem('sid');
      
      const response = await axios.post(`/api/materials/course/${filterCourse || 'general'}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-sid': sid,
        },
      });

      if (response.data.ok) {
        message.success('Material uploaded successfully');
        setUploadModalVisible(false);
        setSelectedFile(null);
        loadMaterials();
      }
    } catch (err) {
      console.error('Upload failed:', err);
      message.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      title: 'File',
      key: 'file',
      render: (_, record) => (
        <div className="file-info">
          <Avatar 
            size="large" 
            icon={getFileIcon(record.originalName)}
            className="file-avatar"
          />
          <div className="file-details">
            <Text strong className="file-name">
              {record.name}
            </Text>
            <div className="file-meta">
              <Text type="secondary">{record.originalName}</Text>
              <Tag color="blue" size="small">
                {formatFileSize(record.size)}
              </Tag>
            </div>
          </div>
        </div>
      ),
      width: 300,
    },
    {
      title: 'Course',
      dataIndex: 'courseCode',
      key: 'courseCode',
      render: (code) => {
        const course = courses.find(c => c.code === code);
        return (
          <div>
            <Text strong>{code}</Text>
            {course && <div><Text type="secondary">{course.title}</Text></div>}
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <Text type="secondary">No description</Text>,
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      render: (sid) => (
        <Tag color="purple">{sid}</Tag>
      ),
    },
    {
      title: 'Downloads',
      dataIndex: 'downloads',
      key: 'downloads',
      render: (count) => (
        <Badge
          count={count}
          style={{ backgroundColor: '#52c41a' }}
          showZero
        />
      ),
      align: 'center',
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date) => formatDate(date),
      sorter: (a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Download">
            <Button
              type="primary"
              shape="circle"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
              size="small"
            />
          </Tooltip>
        </Space>
      ),
      align: 'center',
    },
  ];

  return (
    <div className="materials-page">
      <div className="materials-header">
        <div>
          <Title level={2}>Learning Materials</Title>
          <Text type="secondary">
            Access and share course materials with other students
          </Text>
        </div>
        
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalVisible(true)}
        >
          Upload Material
        </Button>
      </div>

      <Card className="filters-card">
        <div className="filters-container">
          <div className="search-container">
            <Search
              placeholder="Search materials by name or description..."
              allowClear
              size="large"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={loadMaterials}
              style={{ width: 300 }}
            />
          </div>
          
          <div className="filter-controls">
            <Select
              placeholder="Filter by course"
              style={{ width: 200 }}
              value={filterCourse}
              onChange={setFilterCourse}
              allowClear
            >
              {courses.map(course => (
                <Option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </Option>
              ))}
            </Select>

            <Select
              placeholder="Sort by"
              style={{ width: 150 }}
              value={sortBy}
              onChange={setSortBy}
            >
              <Option value="uploadedAt">Upload Date</Option>
              <Option value="downloads">Downloads</Option>
              <Option value="name">Name</Option>
            </Select>

            <Button.Group>
              <Button
                type={sortOrder === 'asc' ? 'primary' : 'default'}
                onClick={() => setSortOrder('asc')}
                icon={<SortAscendingOutlined />}
              >
                Asc
              </Button>
              <Button
                type={sortOrder === 'desc' ? 'primary' : 'default'}
                onClick={() => setSortOrder('desc')}
                icon={<SortAscendingOutlined rotate={180} />}
              >
                Desc
              </Button>
            </Button.Group>

            <Button
              icon={<FilterOutlined />}
              onClick={loadMaterials}
              loading={loading}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card className="materials-list">
        <Table
          columns={columns}
          dataSource={materials}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} materials`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text>No materials found</Text>
                    <div style={{ marginTop: 16 }}>
                      <Button 
                        type="primary" 
                        onClick={() => setUploadModalVisible(true)}
                      >
                        Upload First Material
                      </Button>
                    </div>
                  </div>
                }
              />
            ),
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="material-expanded">
                <div className="expanded-section">
                  <Text strong>Description:</Text>
                  <Text style={{ display: 'block', marginTop: 8 }}>
                    {record.description || 'No description provided'}
                  </Text>
                </div>
                
                {record.tags && record.tags.length > 0 && (
                  <div className="expanded-section">
                    <Text strong>Tags:</Text>
                    <div style={{ marginTop: 8 }}>
                      {record.tags.map((tag, index) => (
                        <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="expanded-section">
                  <Text strong>File Information:</Text>
                  <div className="file-info-grid">
                    <div>
                      <Text type="secondary">Original Name:</Text>
                      <div>{record.originalName}</div>
                    </div>
                    <div>
                      <Text type="secondary">Size:</Text>
                      <div>{formatFileSize(record.size)}</div>
                    </div>
                    <div>
                      <Text type="secondary">Type:</Text>
                      <div>{record.mimetype}</div>
                    </div>
                    <div>
                      <Text type="secondary">Uploaded:</Text>
                      <div>{formatDate(record.uploadedAt)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ),
            rowExpandable: () => true,
          }}
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title="Upload Material"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setSelectedFile(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setUploadModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={uploading}
            onClick={submitUpload}
            disabled={!selectedFile || !filterCourse}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>,
        ]}
        width={600}
      >
        <div className="upload-modal-content">
          <div className="upload-section">
            <Text strong>Select Course:</Text>
            <Select
              placeholder="Choose a course"
              style={{ width: '100%', marginTop: 8 }}
              value={filterCourse}
              onChange={setFilterCourse}
              required
            >
              {courses.map(course => (
                <Option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </Option>
              ))}
            </Select>
          </div>

          <div className="upload-section">
            <Text strong>Upload File:</Text>
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={handleUpload}
              onRemove={() => setSelectedFile(null)}
              fileList={selectedFile ? [selectedFile] : []}
              className="upload-dragger"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Support for single file upload. Max file size: 20MB
              </p>
            </Dragger>
          </div>

          {selectedFile && (
            <div className="file-preview">
              <div className="preview-header">
                <Text strong>File Preview:</Text>
              </div>
              <div className="preview-content">
                <Avatar 
                  size={48} 
                  icon={getFileIcon(selectedFile.name)}
                  className="preview-avatar"
                />
                <div className="preview-details">
                  <Text strong>{selectedFile.name}</Text>
                  <Text type="secondary">
                    Size: {formatFileSize(selectedFile.size)}
                  </Text>
                  <Text type="secondary">
                    Type: {selectedFile.type || 'Unknown'}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Materials;
