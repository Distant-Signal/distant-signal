//! Honest, identifying `User-Agent` strings for outbound requests to
//! third-party hosts (LEG-21 / LEG-24).
//!
//! Every service that fetches from someone else's server should say who it
//! is and where to find out more, rather than sending no `User-Agent` at all
//! (reqwest's default) or impersonating a browser. The string is built at
//! the *call site's* compile time by [`user_agent!`](crate::user_agent), so
//! each binary names itself and its own crate version:
//!
//! ```text
//! distant-signal-poller-irish-rail-live/0.1.0 (+https://github.com/FasterSpeeding/Distant-Signal)
//! ```
//!
//! The URL comes from `DS_PROJECT_URL` at compile time, not from a literal
//! here, so it follows the repository's owner:
//! .github/workflows/containers.yml passes the building repository's URL
//! into every Rust image build, and `.cargo/config.toml` holds the default
//! for local builds and CI's cargo jobs.

/// Public project URL carried in every [`user_agent!`](crate::user_agent)
/// string, so an upstream operator seeing our traffic can find the source
/// and a contact route. `DS_PROJECT_URL` at compile time (see the module
/// docs); the macro reads the same variable, and the unit test below pins
/// the two together.
pub const PROJECT_URL: &str = env!("DS_PROJECT_URL");

// An empty or non-https `DS_PROJECT_URL` (say, a build arg passed blank)
// fails the build rather than shipping a User-Agent with no contact URL.
const _: () = assert!(
    is_https_url(PROJECT_URL),
    "DS_PROJECT_URL must be an https:// URL"
);

/// Whether `url` starts with `https://` and has something after it.
const fn is_https_url(url: &str) -> bool {
    let (url, prefix) = (url.as_bytes(), b"https://".as_slice());
    if url.len() <= prefix.len() {
        return false;
    }
    let mut i = 0;
    while i < prefix.len() {
        if url[i] != prefix[i] {
            return false;
        }
        i += 1;
    }
    true
}

/// Expands to a `&'static str` `User-Agent` of the form
/// `distant-signal-<calling crate>/<calling crate version> (+<project URL>)`.
///
/// `env!("CARGO_PKG_NAME")`/`env!("CARGO_PKG_VERSION")` resolve in the crate
/// that invokes the macro, not in `common`, which is the whole reason this
/// is a macro rather than a `const`.
#[macro_export]
macro_rules! user_agent {
    () => {
        concat!(
            "distant-signal-",
            env!("CARGO_PKG_NAME"),
            "/",
            env!("CARGO_PKG_VERSION"),
            " (+",
            env!("DS_PROJECT_URL"),
            ")"
        )
    };
}

#[cfg(test)]
mod tests {
    use super::{PROJECT_URL, is_https_url};

    #[test]
    fn user_agent_names_the_calling_crate_version_and_project() {
        let ua = crate::user_agent!();
        assert_eq!(
            ua,
            format!(
                "distant-signal-common/{} (+{PROJECT_URL})",
                env!("CARGO_PKG_VERSION")
            )
        );
        assert!(!ua.contains("Mozilla"));
    }

    #[test]
    fn project_url_check_wants_an_https_url() {
        assert!(is_https_url(
            "https://github.com/Distant-Signal/distant-signal"
        ));
        assert!(!is_https_url(""));
        assert!(!is_https_url("https://"));
        assert!(!is_https_url("http://example.com"));
    }
}
