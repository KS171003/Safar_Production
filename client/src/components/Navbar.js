import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
} from "@mui/material";
import {
  AccountCircle,
  DirectionsBus,
  Person,
  ExitToApp,
  Menu as MenuIcon,
} from "@mui/icons-material";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMobileMenuAnchor(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    handleMenuClose();
  };

  const isMenuOpen = Boolean(anchorEl);
  const isMobileMenuOpen = Boolean(mobileMenuAnchor);

  const menuId = "primary-search-account-menu";
  const mobileMenuId = "primary-search-account-menu-mobile";

  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      id={menuId}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={isMenuOpen}
      onClose={handleMenuClose}
    >
      <MenuItem onClick={handleMenuClose}>
        <Person sx={{ mr: 1 }} />
        Profile
      </MenuItem>
      <MenuItem onClick={handleLogout}>
        <ExitToApp sx={{ mr: 1 }} />
        Logout
      </MenuItem>
    </Menu>
  );

  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMenuAnchor}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      id={mobileMenuId}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={isMobileMenuOpen}
      onClose={handleMenuClose}
    >
      {user?.userType === "conductor" && (
        <MenuItem
          onClick={() => {
            navigate("/conductor");
            handleMenuClose();
          }}
        >
          <DirectionsBus sx={{ mr: 1 }} />
          Dashboard
        </MenuItem>
      )}
      {user?.userType === "passenger" && (
        <MenuItem
          onClick={() => {
            navigate("/passenger");
            handleMenuClose();
          }}
        >
          <DirectionsBus sx={{ mr: 1 }} />
          Find Bus
        </MenuItem>
      )}
      <MenuItem onClick={handleLogout}>
        <ExitToApp sx={{ mr: 1 }} />
        Logout
      </MenuItem>
    </Menu>
  );

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        <DirectionsBus sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Safar
        </Typography>

        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
          {user?.userType === "conductor" && (
            <>
              <Button color="inherit" component={Link} to="/conductor">
                Dashboard
              </Button>
              <Button color="inherit" component={Link} to="/routes">
                Routes
              </Button>
              <Button color="inherit" component={Link} to="/emergency">
                Emergency
              </Button>
            </>
          )}
          {user?.userType === "passenger" && (
            <Button color="inherit" component={Link} to="/passenger">
              Find Bus
            </Button>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", ml: 2 }}>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls={menuId}
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              <AccountCircle />
            </Avatar>
          </IconButton>
        </Box>

        <Box sx={{ display: { xs: "flex", md: "none" } }}>
          <IconButton
            size="large"
            aria-label="show more"
            aria-controls={mobileMenuId}
            aria-haspopup="true"
            onClick={handleMobileMenuOpen}
            color="inherit"
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Toolbar>
      {renderMenu}
      {renderMobileMenu}
    </AppBar>
  );
};

export default Navbar;
