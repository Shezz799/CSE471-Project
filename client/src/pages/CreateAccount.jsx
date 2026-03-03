import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const SKILLS = ["python", "java", "c", "c++", "c#", "react"];

const CreateAccount = () => {
  const navigate = useNavigate();
  const { user, setUserProfile } = useAuth();
  const [form, setForm] = useState({
    bio: "",
    skills: [],
    department: "",
    phone: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      SKILLS.map((skill) => (
        <label key={skill} className="option">
          <input
            type="checkbox"
            value={skill}
            checked={form.skills.includes(skill)}
            onChange={(event) => {
              const { checked, value } = event.target;
              setForm((prev) => ({
                ...prev,
                skills: checked
                  ? [...prev.skills, value]
                  : prev.skills.filter((item) => item !== value),
              }));
            }}
          />
          <span>{skill}</span>
        </label>
      )),
    [form.skills]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const skillsLabel = form.skills.length ? form.skills.join(", ") : "Select skills";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { data } = await api.put("/api/users/profile", form);
      setUserProfile(data.data.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Account creation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="card stack">
        <div>
          <h1 className="title">Complete your profile</h1>
          <p className="subtitle">Tell us a bit about yourself.</p>
        </div>
        {error && <div className="error">{error}</div>}
        <form className="stack" onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              className="input"
              rows={3}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="skills">Skills and Expertise</label>
            <details className="multiselect" id="skills">
              <summary className="input">{skillsLabel}</summary>
              <div className="options">
                {options}
              </div>
            </details>
          </div>
          <div className="field">
            <label className="label" htmlFor="department">Department</label>
            <input
              id="department"
              name="department"
              value={form.department}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="phone">Phone number</label>
            <input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="linkedinUrl">LinkedIn URL</label>
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              value={form.linkedinUrl}
              onChange={handleChange}
              className="input"
              type="url"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="githubUrl">GitHub URL</label>
            <input
              id="githubUrl"
              name="githubUrl"
              value={form.githubUrl}
              onChange={handleChange}
              className="input"
              type="url"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="portfolioUrl">Portfolio URL</label>
            <input
              id="portfolioUrl"
              name="portfolioUrl"
              value={form.portfolioUrl}
              onChange={handleChange}
              className="input"
              type="url"
              required
            />
          </div>
          <button className="button" type="submit" disabled={saving || !user}>
            {saving ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateAccount;
