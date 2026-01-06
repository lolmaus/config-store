import {createRootRoute, Link, Outlet} from '@tanstack/react-router';
import {TanStackRouterDevtools} from '@tanstack/react-router-devtools';

const RootLayout = () => (
  <>
    <ul>
      <li>
        <Link to="/" className="">
          Home
        </Link>
      </li>

      <li>
        <Link to="/local-storage-custom-key" className="">
          Local Storage, Custom Key
        </Link>
      </li>

      <li>
        <Link to="/local-storage-default-key" className="">
          Local Storage, Default Key
        </Link>
      </li>

      <li>
        <Link to="/local-storage-successful-migration" className="">
          Local Storage, Successful Migration
        </Link>
      </li>

      <li>
        <Link to="/local-storage-faulty-migration" className="">
          Local Storage, Faulty Migration
        </Link>
      </li>
    </ul>
    <hr />
    <Outlet />
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({component: RootLayout});
