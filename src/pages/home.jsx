import AdminDashboard from './dashboard/AdminDashboard.jsx';
import EmployeeDashboard from './dashboard/EmployeeDashboard.jsx';
import { isAdminRole } from '../config/rolesConfig.jsx';

export default function Home(props) {
  return isAdminRole(props.user?.role)
    ? <AdminDashboard {...props} />
    : <EmployeeDashboard {...props} />;
}
