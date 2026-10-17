import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const register = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ register }) }));
vi.mock('../components/LocationPicker', () => ({ default: () => null }));

// Imported after the mocks so Register picks them up.
const { default: Register, passwordRules } = await import('./Register');
const { emailRule } = await import('./Login');

const setup = () => render(<MemoryRouter><Register /></MemoryRouter>);

describe('registration form validation', () => {
  it('shows an error for every missing required field and does not call the API', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a malformed email and a mismatched confirmation', async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/full name/i), 'Asha Verma');
    await userEvent.type(screen.getByLabelText(/^email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Passw0rd!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Different1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('requires organization details when joining as an organization', async () => {
    setup();
    await userEvent.click(screen.getByLabelText(/an organization/i));
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Organization name is required')).toBeInTheDocument();
    expect(screen.getByText('Select an organization type')).toBeInTheDocument();
  });
});

describe('validation rules', () => {
  it('password must contain a letter and a number', () => {
    expect(passwordRules.validate('abcdefgh')).toMatch(/letter and one number/);
    expect(passwordRules.validate('12345678')).toMatch(/letter and one number/);
    expect(passwordRules.validate('abcd1234')).toBe(true);
    expect(passwordRules.minLength.value).toBe(8);
  });

  it('email pattern accepts normal addresses only', () => {
    expect(emailRule.pattern.value.test('asha@sahyog.local')).toBe(true);
    expect(emailRule.pattern.value.test('asha@')).toBe(false);
    expect(emailRule.pattern.value.test('a b@c.d')).toBe(false);
  });
});
