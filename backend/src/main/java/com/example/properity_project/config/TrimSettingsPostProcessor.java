package com.example.properity_project.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

/**
 * Hosting dashboards make it easy to paste a value with a hidden space or tab at either end
 * ("\tavnadmin" is a different database user). Trim the connection and secret settings so that
 * mistake can never stop the app from starting.
 */
public class TrimSettingsPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final String[] KEYS = {"spring.datasource.url", "spring.datasource.username",
            "spring.datasource.password", "jwt.secret", "app.agent.email", "app.agent.password"};

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication app) {
        Map<String, Object> trimmed = new HashMap<>();
        for (String key : KEYS) {
            String value = env.getProperty(key);
            if (value != null && !value.equals(value.trim())) trimmed.put(key, value.trim());
        }
        if (!trimmed.isEmpty()) env.getPropertySources().addFirst(new MapPropertySource("trimmedSettings", trimmed));
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
