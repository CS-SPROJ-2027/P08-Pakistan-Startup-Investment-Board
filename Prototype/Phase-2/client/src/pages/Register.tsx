/**
 * UC-001: Registration page.
 * The user picks a role and fills in their details.
 * All fields are required. Founders enter their company, others their organisation.
 */
import { useState, ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';

const emptyForm = {
  role: 'founder',
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  organisation: '',
};

function Register() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/auth/register', 'POST', form);
      setSuccess(data.message);
      setForm(emptyForm);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card form-card">
      <h2>Create an account</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="role">I am a</label>
        <select id="role" name="role" value={form.role} onChange={handleChange}>
          <option value="founder">Founder</option>
          <option value="investor">Investor</option>
          <option value="incubator">Incubator Manager</option>
        </select>

        <label htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />

        <label htmlFor="organisation">{form.role === 'founder' ? 'Company name' : 'Organisation'}</label>
        <input id="organisation" name="organisation" value={form.organisation} onChange={handleChange} required />

        <label htmlFor="password">Password (at least 8 characters)</label>
        <input id="password" name="password" type="password" value={form.password} onChange={handleChange} required />

        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange}
          required
        />

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}

export default Register;
