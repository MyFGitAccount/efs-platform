import React from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  FileOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const navigate = useNavigate();
  const sid = localStorage.getItem('sid');
  const role = localStorage.getItem('role');

  const handleLogout = () => {
    localStorage.removeItem('sid');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        <Link to="/profile">Profile</Link>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );

  const menuItems = [
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: <Link to="/calendar">Timetable Planner</Link>,
    },
    {
      key: '/group-formation',
      icon: <TeamOutlined />,
      label: <Link to="/group-formation">Group Formation</Link>,
    },
    {
      key: '/questionnaire',
      icon: <FileTextOutlined />,
      label: <Link to="/questionnaire">Questionnaire Exchange</Link>,
    },
    {
      key: '/materials',
      icon: <FileOutlined />,
      label: <Link to="/materials">Learning Materials</Link>,
    },
  ];

  if (role === 'admin') {
    menuItems.push({
      key: '/admin',
      icon: <DashboardOutlined />,
      label: <Link to="/admin">Admin Panel</Link>,
    });
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <h2 style={{ color: 'white', margin: 0 }}>EFS Platform</h2>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/dashboard']}
          items={menuItems}
        />
      </Sider>
      <Layout style={{ marginLeft: 200 }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ flex: 1 }} />
          <Space align="center">
            <span>Welcome, {sid}</span>
            <Dropdown overlay={userMenu} placement="bottomRight">
              <Avatar
                style={{ cursor: 'pointer' }}
                icon={<UserOutlined />}
              />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 'calc(100vh - 112px)' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
