"use client";

import { useState } from "react";

export default function LandingPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <main>
        <section className="hero" id="top">
          <div className="corner-logo">introduced</div>

          <div className="hero-inner">
            <img
              className="hero-mascot"
              src="/hero-mascot.png"
              alt="Smiling heart mascot"
            />

            <div className="hero-copy">
              <div className="brand">Introduced</div>
              <h1>Want to be introduced?</h1>
              <p>
                Fill out your profile to be thoughtfully matched with someone
                whose values, personality, and relationship goals align with
                yours.
              </p>
              <a className="button" href="#profile">
                Fill out your profile
              </a>
            </div>
          </div>
        </section>

        <section className="intro-strip" id="how">
          <article className="intro-step">
            <span className="step-number">01 — PROFILE</span>
            <h2>Tell us who you are.</h2>
            <p>Share your values, personality, lifestyle, and relationship goals.</p>
          </article>

          <article className="intro-step">
            <span className="step-number">02 — MATCH</span>
            <h2>We look for alignment.</h2>
            <p>
              Your answers help us identify people who may genuinely complement
              you.
            </p>
          </article>

          <article className="intro-step">
            <span className="step-number">03 — INTRODUCTION</span>
            <h2>Meet your match.</h2>
            <p>
              If the interest is mutual, we make the introduction. No endless
              swiping.
            </p>
          </article>
        </section>

        <section className="profile-section" id="profile">
          <div className="profile-heading">
            <div className="profile-heading-inner">
              <span className="small-label">Get started</span>
              <h2>Tell us about yourself.</h2>
              <p>
                A few thoughtful answers can tell us much more than a swipe ever
                could. Your profile remains private and is only used to help make
                intentional introductions.
              </p>
            </div>
          </div>

          <div className="form-wrap">
            <form className="profile-form" id="profileForm" onSubmit={handleSubmit}>
              {!submitted ? (
                <div id="formFields">
                  <div className="field-grid">
                    <div className="field">
                      <label htmlFor="name">First name</label>
                      <input id="name" name="name" type="text" required />
                    </div>

                    <div className="field">
                      <label htmlFor="email">Email</label>
                      <input id="email" name="email" type="email" required />
                    </div>

                    <div className="field">
                      <label htmlFor="age">Age</label>
                      <input id="age" name="age" type="number" min={18} required />
                    </div>

                    <div className="field">
                      <label htmlFor="location">Location</label>
                      <input id="location" name="location" type="text" required />
                    </div>

                    <div className="field">
                      <label htmlFor="goal">Relationship goal</label>
                      <select id="goal" name="goal" defaultValue="Long-term relationship">
                        <option>Long-term relationship</option>
                        <option>Marriage</option>
                        <option>Dating intentionally</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="distance">Preferred distance</label>
                      <select id="distance" name="distance" defaultValue="Within 25 miles">
                        <option>Within 25 miles</option>
                        <option>Within 50 miles</option>
                        <option>Within 100 miles</option>
                        <option>Open to long distance</option>
                      </select>
                    </div>

                    <div className="field full">
                      <label htmlFor="about">Tell us about yourself</label>
                      <textarea
                        id="about"
                        name="about"
                        placeholder="Your personality, interests, lifestyle, and values..."
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor="looking">Who are you hoping to meet?</label>
                      <textarea
                        id="looking"
                        name="looking"
                        placeholder="Describe the person and relationship you are looking for..."
                      />
                    </div>
                  </div>

                  <button className="button submit-button" type="submit">
                    Submit my profile
                  </button>
                </div>
              ) : (
                <div className="success show" id="successMessage">
                  <h3>You&rsquo;re ready to be introduced.</h3>
                  <p>Your profile has been submitted.</p>
                </div>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>&copy; {new Date().getFullYear()} Introduced</span>
        <span>Thoughtful matchmaking. Real introductions.</span>
      </footer>
    </>
  );
}
